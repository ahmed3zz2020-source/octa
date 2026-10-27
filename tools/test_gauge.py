#!/usr/bin/env python3
"""فحص مودال «مؤشر السوق العام» في متصفح حقيقي (390px).

Usage: python3 tools/test_gauge.py [url]
"""
import sys, time, os
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "https://octa-preview.ahmed3zz2020.workers.dev"
CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
SHOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "shots", "gauge-modal.png")

ok = True


def check(cond, label):
    global ok
    print(("   ✅ " if cond else "   ❌ ") + label)
    if not cond:
        ok = False


with sync_playwright() as p:
    br = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"], executable_path=CHROME)
    pg = br.new_page(viewport={"width": 390, "height": 844})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    # ⛔ 401 (مفيش جلسة على المعاينة) ورسالة CSP =-console عادي، مش خطأ JS
    BENIGN = ("401", "Content Security Policy", "favicon", "Failed to load resource")
    pg.on("console", lambda m: errs.append(m.text) if (m.type == "error" and not any(b in m.text for b in BENIGN)) else None)

    pg.goto(URL + "/index.html", wait_until="domcontentloaded", timeout=60000)
    time.sleep(5)
    pg.evaluate("""() => { var g = document.getElementById('gate'); if (g) g.style.display = 'none';
        document.body.classList.add('nogate'); }""")
    time.sleep(5)

    # ⏳ استنى الكارت
    for _ in range(20):
        if pg.evaluate("() => !!document.querySelector('.bb-strip')"):
            break
        time.sleep(1)
    check(pg.evaluate("() => !!document.querySelector('.bb-strip')"), "كارت مؤشر السوق موجود")

    card = pg.evaluate("() => { var c = document.querySelector('.bb-strip'); return c ? c.innerText.replace(/\\s+/g,' ').trim() : ''; }")
    print("   ▸ الكارت: " + card[:110])
    check("مؤشر" in card or any(ch.isdigit() for ch in card), "الكارت فيه الرقم")

    pg.evaluate("() => { var c = document.querySelector('.bb-strip'); if (c) c.click(); }")
    time.sleep(1)
    time.sleep(2)

    modal = pg.evaluate("() => { var m = document.getElementById('mg-modal'); return m ? m.innerText : ''; }")
    check(len(modal) > 400, "المودال اتفتح (" + str(len(modal)) + " حرف)")

    for label, needle in [
        ("العنوان", "مؤشر السوق العام"),
        ("الرقم", "35"),
        ("المكوّنات الثلاثة", "المكوّنات الثلاثة"),
        ("مزاج السوق", "مزاج السوق"),
        ("متوسط النتيجة", "متوسط النتيجة"),
        ("الأمان", "الأمان"),
        ("قرارات الأسهم", "قرارات الأسهم"),
        ("سلّم القراءة", "سلّم القراءة"),
        ("حدود المؤشر", "حدود المؤشر"),
        ("خطوات الحساب", "الحساب خطوة بخطوة"),
    ]:
        check(needle in modal, label + " موجود")

    steps = pg.evaluate("() => document.querySelectorAll('.mg-step').length")
    check(steps == 5, "خطوات الحساب = ٥ (لا Found: %s)" % steps)

    nums = pg.evaluate("""() => { var m = document.getElementById('mg-modal') || document.body;
        return (m.innerText.match(/[0-9٠-٩]/g) || []).length; }""")
    print("   ▸ أرقام داخل المودال: %s" % nums)

    # ⛔ الأرقام بالإشارة لازم تكون LTR
    ltr = pg.evaluate("""() => { var bad = [];
        document.querySelectorAll('.mg-step-m, .mg-comp-m').forEach(function(e){
            var t = e.innerText.trim();
            if (/^\\u2212|-\\d|^\\+/.test(t)) { var d = getComputedStyle(e).direction; if (d !== 'ltr') bad.push(t.slice(0,18)); }
        }); return bad; }""")
    check(not ltr, "مفيش رقم بإشارة في غير LTR")

    pg.screenshot(path=SHOT, full_page=False)
    print("   📸 " + os.path.abspath(SHOT))

    check(not errs, "مفيش أخطاء JS" + ("" if not errs else ": " + str(errs[:2])))
    br.close()

print("\n" + ("✅ المودال شغال" if ok else "❌ في مشاكل"))
sys.exit(0 if ok else 1)
