#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""🧪 فحص تبويب «الادخار» في متصفح حقيقي (٢٧ أكتوبر ٢٠٢٦)"""
import os, sys, subprocess, time, json

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = 8099
API = "https://octa-prices-production-4ccb.up.railway.app"
OUT = "/tmp/shot"
os.makedirs(OUT, exist_ok=True)

srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1"],
                       cwd=HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.5)
fails = []


def check(c, m):
    if not c:
        fails.append(m); print("   ❌", m)
    else:
        print("   ✅", m)


try:
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        # ⛔ الـheadless-shell مش متثبت — بنستخدم chromium الكامل
        exe = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
        br = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"],
                               executable_path=exe if os.path.exists(exe) else None)
        pg = br.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2)
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append("PAGEERROR: " + str(e)))
        pg.add_init_script(
            "window.OCTA_API='%s';window.OCTADev=window.OCTADev||{};"
            "addEventListener('DOMContentLoaded',function(){setTimeout(function(){"
            "var g=document.getElementById('gate');if(g)g.style.display='none';"
            "var b=document.body;if(b)b.classList.add('nogate');},400);});" % API)
        pg.goto("http://127.0.0.1:%d/index.html" % PORT, wait_until="domcontentloaded", timeout=45000)
        time.sleep(4)
        # اقفل البوابة
        pg.evaluate("""() => {
          var g=document.getElementById('gate'); if(g) g.style.display='none';
          var gs=document.querySelectorAll('.gate,.gatescreen,#gateScreen');
          gs.forEach(function(x){x.style.display='none';});
          document.body.classList.add('nogate');
        }""")
        time.sleep(1)
        # افتح مودال الذهب
        opened = pg.evaluate("""() => {
          if (typeof window.openGoldIntel === 'function') { window.openGoldIntel(); return 'fn'; }
          var c = document.getElementById('glbCard');
          if (c) { c.click(); return 'card'; }
          return 'none';
        }""")
        check(opened != "none", "مودال الذهب اتفتح (%s)" % opened)
        time.sleep(3)
        tabs = pg.query_selector_all("#gtabs .gtab")
        check(len(tabs) == 2, "فيه %d تبويب" % len(tabs))
        names = [t.inner_text().strip() for t in tabs]
        check("الادخار" in names, "في تبويب «الادخار» (المتاح: %s)" % names)
        # ⛔ octa-api.js بيكتب OCTA_API = '' وقت التحميل ⇒ نعيد ضبطه بعدين
        pg.evaluate("window.OCTA_API = '%s';" % API)
        pg.evaluate("""() => {
          var b=document.querySelector('#gtabs .gtab[data-tab="save"]');
          if(b) b.click();
        }""")
        time.sleep(1)
        pg.evaluate("""() => {
          var b=document.querySelector('#gtabs .gtab[data-tab="save"]');
          if(b) b.click();
        }""")
        time.sleep(7)
        dbg = pg.evaluate("() => (document.querySelector('.gbody')||{}).innerText || '(فاضي)'")
        print("   ── محتوى اللوحة (أول ٤٠٠ حرف) ──")
        print("   " + dbg[:400].replace("\n", " | "))
        _old = "اضغط «الادخار»"
        cards = pg.query_selector_all(".gsave-card")
        check(len(cards) >= 5, "عدد الكروت: %d" % len(cards))
        txt = pg.evaluate("() => (document.querySelector('.gbody')||{}).innerText || ''")
        for kw in ["الخلاصة التحليلية", "سعر الجرام", "العائد على الادخار",
                   "السيناريوهات", "محرك العوامل", "تفكيك الحركة", "الصورة الفنية"]:
            check(kw in txt, "في قسم «%s»" % kw)
        check("غير متاح" in txt or "—" in txt, "النواقص بتتقال «غير متاح»")
        # ⛔ مفيش احتمالات ولا وعود في النص
        for bad in ["احتمال الصعود", "مضمون", "ضمان العائد", "نضمن"]:
            check(bad not in txt, "مفيش «%s»" % bad)
        # ⛔ مفيش إنجليزي مكشوف في العناوين
        heads = pg.evaluate("""() => Array.from(document.querySelectorAll('.gsave-card-t,.gsave-sc-h,.gsave-fg-t')).map(function(e){return e.innerText.trim();})""")
        import re
        eng = [h for h in heads if re.search(r"[A-Za-z]{3,}", h)]
        check(not eng, "مفيش كلمات إنجليزية في العناوين (%s)" % (eng or "مفيش"))
        # الجدول
        rows = pg.query_selector_all(".gsave-tbl tbody tr")
        check(len(rows) >= 4, "صفوف جدول الادخار: %d" % len(rows))
        # الشارت
        ch = pg.query_selector("#gsave-chart-box")
        check(ch is not None, "صندوق الشارت موجود")
        if ch:
            bb = ch.bounding_box()
            check(bb and bb["height"] > 150, "ارتفاع الشارت: %s" % (bb or {}).get("height"))
            canv = pg.query_selector_all("#gsave-chart-box canvas")
            check(len(canv) > 0, "الشارت اترسم (canvas: %d)" % len(canv))
        # مفيش أخطاء JS
        real = [e for e in errs if "favicon" not in e.lower()
                and "Failed to load resource" not in e
                and "Content Security Policy" not in e]
        check(not real, "مفيش أخطاء JS (%s)" % (real[:2] or "مفيش"))
        pg.screenshot(path=OUT + "/gold-savings.png", full_page=False)
        # لقطة المودال كامل
        pg.evaluate("""() => { var b=document.querySelector('.gbody'); if(b) b.scrollTop=0; }""")
        time.sleep(0.5)
        pg.screenshot(path=OUT + "/gold-savings-full.png", full_page=True)
        print("\n📄 الأكواد في:", OUT)
        br.close()
except Exception as e:
    print("❌ استثناء:", e)
    fails.append(str(e))
finally:
    srv.terminate()

print("\n" + "=" * 60)
if fails:
    print("❌ فشل %d" % len(fails))
    for f in fails:
        print("   -", f)
    sys.exit(1)
print("✅ كل فحوص تبويب الادخار عدّت")
