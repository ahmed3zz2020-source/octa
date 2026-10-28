#!/usr/bin/env python3
"""فحص صفحة السهم: الأقسام الثلاثة (الدرجة موثوقة · القاعدة والمستويات · تنبيه التعارض)
+ فحص باغ الـ65,000px (التحليل كان بيفتح تحت ٦٥ ألف بكسل).

Usage: python3 tools/test_intel_modal.py [url]
"""
import sys, os, json, time, urllib.request
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "https://octa-preview.ahmed3zz2020.workers.dev"
API = "https://octa-prices-production-4ccb.up.railway.app"
CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
SHOT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "shots")

ok = True


def check(cond, label):
    global ok
    print(("   ✅ " if cond else "   ❌ ") + label)
    if not cond:
        ok = False


def mint():
    req = urllib.request.Request(
        API + "/api/admin/mint_session",
        data=json.dumps({"email": "ahmed3zz2020@gmail.com", "ttl": 1800}).encode(),
        headers={"X-OCTA-Admin": os.environ.get("OCTA_ADMIN_TOKEN", ""), "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())["token"]


def click_tab(pg, needle):
    pg.evaluate("""(needle) => {
      var b = Array.from(document.querySelectorAll('.si-tab')).find(function (x) { return x.innerText.indexOf(needle) >= 0; });
      if (b) b.click(); }""", needle)


def panel_text(pg, pid):
    return pg.evaluate("(pid) => { var p = document.getElementById(pid); return p ? p.innerText : ''; }", pid)


TOKEN = mint()
print("   ▸ جلسة اختبار اتعملت")

with sync_playwright() as p:
    br = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"], executable_path=CHROME)
    ctx = br.new_context(viewport={"width": 390, "height": 844})
    dom = URL.split("//", 1)[1].split("/", 1)[0]
    ctx.add_cookies([{"name": "octa_token", "value": TOKEN, "domain": dom, "path": "/"}])
    ctx.add_init_script("try { localStorage.setItem('octa_token', %s); } catch (e) {}" % json.dumps(TOKEN))
    pg = ctx.new_page()
    errs = []
    BENIGN = ("401", "Content Security Policy", "favicon", "Failed to load resource")
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if (m.type == "error" and not any(b in m.text for b in BENIGN)) else None)

    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(7)

    gate = pg.evaluate("() => { var g = document.getElementById('gate'); return g ? getComputedStyle(g).display : 'none-el'; }")
    check(gate in ("none", "none-el"), "البوابة مقفولة (الجلسة شغالة)")

    def open_stock(code, wait=25):
        """نفتح السهم ونستنى لحد ما الكود يبان فعلاً في الهيدر (مش وقت عشوائي)."""
        pg.evaluate("(c) => { try { openStock(c); } catch (e) { } }", code)
        for _ in range(wait):
            time.sleep(1)
            shown = pg.evaluate("""() => {
              var e = document.querySelector('#siContent .si-code');
              var l = document.querySelector('#siContent .si-loading, #siContent .si-load');
              return e ? e.innerText.trim() : ''; }""")
            if shown == code:
                time.sleep(2)
                return True
        return False

    check(open_stock("COMI"), "صفحة COMI اتفتحت")

    geo = pg.evaluate("""() => {
      var sp = document.getElementById('stockPage');
      var si = document.getElementById('siContent');
      var r = si ? si.getBoundingClientRect() : null;
      return { spDisp: sp ? getComputedStyle(sp).display : 'x',
               top: r ? Math.round(r.top) : -1, scrollY: Math.round(window.scrollY),
               h: r ? Math.round(r.height) : 0 }; }""")
    print("   ▸ موضع صفحة السهم: " + json.dumps(geo))
    check(geo["spDisp"] == "block", "صفحة السهم ظاهرة")
    check(geo["top"] is not None and geo["top"] < 2000, "صفحة السهم قريبة من فوق (مش ٦٥ ألف بكسل)")
    check(geo["h"] > 1500, "الصفحة كاملة (التبويبات اتحمّلت) — ارتفاع " + str(geo["h"]))

    tabs = pg.evaluate("() => Array.from(document.querySelectorAll('.si-tab')).map(t => t.innerText.trim())")
    print("   ▸ التبويبات: " + " · ".join(tabs))
    check(any("القاعدة" in t for t in tabs), "تبويب «القاعدة والمستويات» موجود")

    # ① الدرجة موثوقة
    click_tab(pg, "ليه التقييم")
    time.sleep(1.5)
    why = panel_text(pg, "si-p-why")
    check("الدرجة موثوقة" in why, "① «الدرجة موثوقة» في تبويب «ليه التقييم كده؟»")
    print("   ▸ تعارض في COMI: %s" % ("موجود" if "التعارض" in why else "مفيش (ماشي)"))

    # ③ تنبيه التعارض — سهم فيه تعارض فعلي
    check(open_stock("MOIL"), "صفحة MOIL اتفتحت")
    click_tab(pg, "ليه التقييم")
    time.sleep(1.5)
    why2 = panel_text(pg, "si-p-why")
    print("   ▸ طول اللوحة: %d" % len(why2))
    has_conf = "التعارض" in why2
    check(has_conf, "③ «تنبيه التعارض» بيظهر في السهم المتعارض (MOIL)")
    for l in why2.split("\n"):
        if "الأمان" in l and "سلبي" in l:
            print("   ▸ " + l[:120])
            break

    # ② القاعدة والمستويات
    open_stock("COMI")
    click_tab(pg, "القاعدة")
    time.sleep(2)
    rule = panel_text(pg, "si-p-levels")
    print("   ▸ القاعدة: " + rule.replace("\n", " · ")[:180])
    check(len(rule) > 40, "② تبويب «القاعدة والمستويات» اتعبّى")
    check(("الوقف" in rule and "الهدف" in rule) or ("مش متاحة" in rule) or ("قديمة" in rule) or ("كافية" in rule),
          "القاعدة فيها الأرقام أو سبب واضح")

    # ⛔ مفيش كلمة إنجليزية طايرة
    lat = pg.evaluate("""() => {
      var t = document.getElementById('siContent').innerText;
      t = t.replace(/[\\u0640-\\u064A]{2,}/g, ' ').replace(/\\b[A-Z]{2,6}\\b/g, ' ');
      var m = t.match(/[A-Za-z]{3,}/g) || [];
      var okw = ['OCTA','RSI','MACD','ATR','SMA','EMA','VWAP','MCDX','AI','API','Beta','Alpha','Smart','Money','Risk','Adjusted','Relative','Strength','Moving','Average','Support','Resistance','Order','Block','Technical','Fundamental','Liquidity','Sentiment','News','Price','Action','Start','Markets','startamarkets','Signal','Invalidation','ROE','ROA','EBITDA','GAAP','TradingView','Live','Market','Analysis','Deep','Book','Levels','Rules','Guide'];
      return m.filter(function (w) { return okw.indexOf(w) < 0; }); }""")
    check(not lat, "مفيش كلمة إنجليزية طايرة" + ("" if not lat else ": " + str(lat[:6])))

    pg.evaluate("() => { var p = document.getElementById('si-p-levels'); if (p) p.scrollIntoView({block:'start'}); }")
    time.sleep(1)
    pg.screenshot(path=os.path.join(SHOT_DIR, "stock-page-levels.png"))
    click_tab(pg, "ليه التقييم")
    time.sleep(1)
    pg.evaluate("() => { var p = document.getElementById('si-p-why'); if (p) p.scrollIntoView({block:'start'}); }")
    time.sleep(1)
    pg.screenshot(path=os.path.join(SHOT_DIR, "stock-page-why.png"))
    print("   📸 shots/stock-page-levels.png + shots/stock-page-why.png")

    check(not errs, "مفيش أخطاء JS" + ("" if not errs else ": " + str(errs[:2])))
    br.close()

print("\n" + ("✅ صفحة السهم سليمة" if ok else "❌ في مشاكل"))
sys.exit(0 if ok else 1)
