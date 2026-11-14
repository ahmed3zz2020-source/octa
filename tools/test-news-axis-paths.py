#!/usr/bin/env python3
"""فحص مسارات الوصول لصفحة «محور الأخبار» — ١٠ نوفمبر ٢٠٢٦.

📌 أحمد قال «مش لاقيه في المعاينة» ⇒ كل مسار لازم يكون **مقيس**:
  ① الشريط الجانبي (☰) ⇒ زر «محور الأخبار»
  ①ب بحث في الشريط الجانبي (اكتب «أخبار»)
  ② الشريط الأفقي (toolbar)
  ③ رابط مباشر: #newsaxis  و  /newsaxis
  ④ زر «كل الأسهم ←» جوّه قسم الأخبار في كارت القرار
  ⑤ زر «محور الأخبار (من هالان) ←» في صفحة «الأخبار» العامة
  ⑥ كارت «محور الأخبار» في لوحة الأسواق

الاستخدام: python3 tools/test-news-axis-paths.py [url]
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


def page_state(pg):
    return pg.evaluate("""() => {
        var p = document.getElementById('page-newsaxis');
        var l = document.getElementById('naList');
        return {
            display: p ? getComputedStyle(p).display : 'missing',
            items: l ? l.querySelectorAll('.dv-item').length : -1,
        };
    }""")


def open_sidebar(pg):
    return pg.evaluate("""() => {
        try { if (typeof sbToggle === 'function') { sbToggle(); return 'sbToggle'; } } catch (e) { }
        var b = document.querySelector('.tb-btns .tb-btn');
        if (b) { b.click(); return 'clicked-btn'; }
        return 'not-found';
    }""")


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

    # ═══ ① الشريط الجانبي ═══
    print("\n▸ ① الشريط الجانبي (☰)")
    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    open_sidebar(pg)
    time.sleep(2.5)
    found = pg.evaluate("""() => {
        var b = document.querySelector('#sideHost [data-tool="newsaxis"]');
        if (!b) return null;
        var rc = b.getBoundingClientRect();
        var e = b, group = '';
        while (e && e.id !== 'sideHost') {
            if (e.previousElementSibling &&
                e.previousElementSibling.classList.contains('sg-h')) {
                group = (e.previousElementSibling.innerText || '').trim().replace(/\\n/g, ' ');
                break;
            }
            e = e.previousElementSibling;
        }
        return { txt: (b.innerText || '').replace(/\\n/g, ' | ').slice(0, 60),
                 rect: [Math.round(rc.x), Math.round(rc.y), Math.round(rc.width), Math.round(rc.height)],
                 visible: rc.width > 0 && rc.height > 0, group: group };
    }""")
    check(found is not None, "زر «محور الأخبار» موجود في الشريط الجانبي", found and found.get('txt'))
    if found:
        check(found["visible"], "الزر ظاهر (مش مخفي)", "rect=%s" % found.get("rect"))
        check("محتوى" in (found.get("group") or ""),
              "الزر في مجموعة «محتوى» (جنب «أخبار»)", found.get("group"))
        print("   ℹ️  y=%s (الـsidebar بيتمرّر — طبيعي)" % found.get("rect", [0, 0])[1])
        shot = os.path.join(OUT, "news-axis-sidebar-390.png")
        pg.screenshot(path=shot)
        print("   📸 " + shot)
        pg.evaluate("""() => {
            var b = document.querySelector('#sideHost [data-tool="newsaxis"]');
            if (b) b.click();
        }""")
        time.sleep(5)
        st = page_state(pg)
        check(st["display"] != "none" and st["items"] > 0,
              "الضغط على الزر بيفتح الصفحة بالأرقام", st)

    # ═══ ①ب البحث في الشريط ═══
    print("\n▸ ①ب البحث في الشريط الجانبي")
    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    open_sidebar(pg)
    time.sleep(2.5)
    has_search = pg.evaluate("()=> !!document.getElementById('sbSearch')")
    check(has_search, "خانة البحث موجودة في الشريط")
    if has_search:
        pg.fill("#sbSearch", "محور")
        time.sleep(1.5)
        vis = pg.evaluate("""() => {
            var b = document.querySelector('#sideHost [data-tool="newsaxis"]');
            if (!b) return null;
            var rc = b.getBoundingClientRect();
            return { display: b.style.display, w: Math.round(rc.width),
                     others: Array.from(document.querySelectorAll('#sideHost .sb-i'))
                        .filter(function (x) { return x.style.display !== 'none'; }).length };
        }""")
        check(vis is not None and vis["display"] != "none" and vis["w"] > 0,
              "البحث «محور» بيظهر الزر", vis)
        check(vis and vis["others"] <= 2,
              "البحث بيخفي باقي الأدوات (نتائج قليلة)", vis and vis["others"])
        shot = os.path.join(OUT, "news-axis-search-390.png")
        pg.screenshot(path=shot)
        print("   📸 " + shot)
        pg.evaluate("""() => {
            var b = document.querySelector('#sideHost [data-tool="newsaxis"]');
            if (b) b.click();
        }""")
        time.sleep(5)
        st = page_state(pg)
        check(st["display"] != "none" and st["items"] > 0,
              "الضغط بعد البحث بيفتح الصفحة بالأرقام", st)

    # ═══ ② الشريط الأفقي ═══
    print("\n▸ ② الشريط الأفقي (toolbar)")
    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    tb = pg.evaluate("""() => {
        var b = document.querySelector('#toolbar [data-tool="newsaxis"]');
        if (!b) return null;
        var rc = b.getBoundingClientRect();
        return { txt: (b.innerText || '').replace(/\\n/g, ' ').slice(0, 40),
                 rect: [Math.round(rc.x), Math.round(rc.y), Math.round(rc.width), Math.round(rc.height)] };
    }""")
    check(tb is not None, "الزر موجود في الشريط الأفقي", tb and tb.get('txt'))

    # ═══ ③ رابط مباشر ═══
    print("\n▸ ③ رابط مباشر")
    for path in ["#newsaxis", "/newsaxis"]:
        pg.goto(URL + path, wait_until="domcontentloaded", timeout=60000)
        time.sleep(9)
        st = page_state(pg)
        check(st["display"] != "none" and st["items"] > 0,
              "الرابط %s بيفتح الصفحة بالأرقام" % path, st)

    # ═══ ④ زر «كل الأسهم» في كارت القرار ═══
    print("\n▸ ④ زر «كل الأسهم» في كارت القرار")
    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    pg.evaluate("() => { try { openCard('ETEL', null, 'egx'); } catch (e) { } }")
    for _ in range(30):
        time.sleep(1)
        if "الأخبار والمحفزات" in pg.evaluate(
                "() => { var b=document.getElementById('mBody'); return b?b.innerText:''; }"):
            break
    link = pg.evaluate("""() => {
        var b = document.getElementById('mBody');
        if (!b) return null;
        var a = Array.from(b.querySelectorAll('a')).find(function (x) {
            return (x.innerText || '').indexOf('كل الأسهم') >= 0;
        });
        return a ? { txt: (a.innerText || '').trim(), href: a.getAttribute('href') } : null;
    }""")
    check(link is not None, "الرابط موجود في قسم الأخبار بالكارت", link and link.get('txt'))
    if link:
        pg.evaluate("""() => {
            var b = document.getElementById('mBody');
            var a = Array.from(b.querySelectorAll('a')).find(function (x) {
                return (x.innerText || '').indexOf('كل الأسهم') >= 0;
            });
            if (a) a.click();
        }""")
        time.sleep(5)
        st = page_state(pg)
        check(st["display"] != "none" and st["items"] > 0,
              "الضغط عليه بيفتح صفحة «محور الأخبار»", st)

    # ═══ ⑤ زر الربط في صفحة «الأخبار» العامة ═══
    print("\n▸ ⑤ زر الربط في صفحة «الأخبار» العامة")
    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    pg.evaluate("() => { try { switchPage('news'); } catch (e) { } }")
    time.sleep(4)
    btn = pg.evaluate("""() => {
        var b = Array.from(document.querySelectorAll('button')).find(function (x) {
            return (x.innerText || '').indexOf('محور الأخبار (من هالان)') >= 0;
        });
        if (!b) return null;
        var rc = b.getBoundingClientRect();
        return { txt: (b.innerText || '').trim(), visible: rc.width > 0 && rc.height > 0 };
    }""")
    check(btn is not None, "الزر موجود في صفحة «الأخبار»", btn and btn.get('txt'))
    if btn:
        pg.evaluate("""() => {
            var b = Array.from(document.querySelectorAll('button')).find(function (x) {
                return (x.innerText || '').indexOf('محور الأخبار (من هالان)') >= 0;
            });
            if (b) b.click();
        }""")
        time.sleep(5)
        st = page_state(pg)
        check(st["display"] != "none" and st["items"] > 0,
              "الضغط عليه بيفتح صفحة «محور الأخبار»", st)

    # ═══ ⑥ كارت في لوحة الأسواق ═══
    print("\n▸ ⑥ كارت «محور الأخبار» في لوحة الأسواق")
    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(8)
    pg.evaluate("() => { try { openMarketsPanel(); } catch (e) { try { switchPage('markets'); } catch (e2) { } } }")
    time.sleep(5)
    card = pg.evaluate("""() => {
        var c = Array.from(document.querySelectorAll('.mk-quick')).find(function (x) {
            return (x.innerText || '').indexOf('محور الأخبار') >= 0;
        });
        if (!c) return null;
        var rc = c.getBoundingClientRect();
        return { txt: (c.innerText || '').replace(/\\n/g, ' | ').slice(0, 70),
                 visible: rc.width > 0 && rc.height > 0 };
    }""")
    check(card is not None, "الكارت موجود في لوحة الأسواق", card and card.get('txt'))
    if card:
        check(card["visible"], "الكارت ظاهر")
        pg.evaluate("""() => {
            var c = Array.from(document.querySelectorAll('.mk-quick')).find(function (x) {
                return (x.innerText || '').indexOf('محور الأخبار') >= 0;
            });
            if (c) c.click();
        }""")
        time.sleep(5)
        st = page_state(pg)
        check(st["display"] != "none" and st["items"] > 0,
              "الضغط على الكارت بيفتح صفحة «محور الأخبار»", st)

    real_errs = [e for e in errs if "halan" not in e.lower() and "newsaxis" not in e.lower()]
    check(not real_errs, "مفيش أخطاء JS", real_errs[:3])

print("")
if ok:
    print("✅ كل مسارات الوصول لصفحة «محور الأخبار» شغالة.")
    sys.exit(0)
print("❌ في مسارات مش شغالة — شوف فوق.")
sys.exit(1)
