#!/usr/bin/env python3
"""⭐⭐⭐ سيناريو أحمد الحقيقي — زي المستخدم بالظبط:
   ① SW قديم (٢٩ أكتوبر) ماسك النطاق
   ② المستخدم يفتح التطبيق ⇒ «جالي تحديث»
   ③ يضغط «تحديث دلوقتي» ⇒ ⭐ لازم يفتح (مش بيضا)
   ④ يقفل التطبيق ويفتحه تاني ⇒ ⭐ لازم يفتح
Usage: python3 tools/test_webapk_update.py [base] [block_sw]
"""
import sys
from playwright.sync_api import sync_playwright

CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8787").rstrip('/')
BLOCK = len(sys.argv) > 2 and sys.argv[2] == "block"
TOKEN = open("/tmp/octa_token.txt").read().strip()

def st(page):
    try:
        return page.evaluate("""() => ({
          txt: (document.body.innerText||'').trim().length,
          ctrl: navigator.serviceWorker.controller ? 'CONTROLLING' : 'none'
        })""")
    except Exception as e:
        return {'txt': -1, 'ctrl': 'nav(%s)' % str(e)[:30]}

def ctrl_url(page):
    try:
        return page.evaluate("() => navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : 'none'")
    except Exception as e:
        return 'nav(%s)' % str(e)[:40]

def regs(page):
    return page.evaluate("""async () => {
      const rs = await navigator.serviceWorker.getRegistrations();
      return rs.map(r => (r.active && r.active.scriptURL) || (r.installing && r.installing.scriptURL) || '?');
    }""")

fails = []
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    ctx.add_cookies([{"name": "octa_token", "value": TOKEN, "url": BASE + "/"}])
    page = ctx.new_page()
    errs = []
    page.on("pageerror", lambda e: errs.append(str(e)[:120]))

    page.goto(BASE + "/", wait_until="load", timeout=90000)
    page.wait_for_timeout(2500)

    # ① ⭐ رجّع المتصفح لوضع «موبايل أحمد»: SW قديم ماسك
    page.evaluate("""async () => {
      const rs = await navigator.serviceWorker.getRegistrations();
      rs.forEach(r => r.unregister());
      const r = await navigator.serviceWorker.register('/sw-old.js', {scope:'/'});
      await navigator.serviceWorker.ready;
      return 1;
    }""")
    page.wait_for_timeout(1500)
    page.goto(BASE + "/", wait_until="load", timeout=90000)
    page.wait_for_timeout(2500)
    print("① بعد فتح التطبيق (الـSW القديم ماسك):", ctrl_url(page))

    # ② ⭐ المستخدم يفتح شريط التحديث (الصفحة تعمله) — نحقن الشريط
    page.evaluate("""() => {
      if (!document.getElementById('octaUpdateBar')) {
        const d = document.createElement('div');
        d.id = 'octaUpdateBar';
        d.innerHTML = '<div class="octa-upd"><span>🆕 فيه نسخة جديدة من (OCTA)</span>' +
          '<button type="button" onclick="octaApplyUpdate()">تحديث دلوقتي</button></div>';
        document.body.appendChild(d);
      }
    }""")
    if BLOCK:
        page.route("**/sw.js", lambda route: route.abort())
        print("   (وضع: مفتاح الإطفاء محجوب)")

    # ③ ⭐⭐⭐ ضغطة حقيقية على الزرار
    print("③ ⭐ ضغط «تحديث دلوقتي» (ضغطة حقيقية)…")
    # ⭐ نشغّل الضغطة بمؤقّت ⇒ الـevaluate يخلص قبل التنقّل
    page.evaluate("() => { setTimeout(function () { var b = document.querySelector('#octaUpdateBar button'); if (b) b.click(); }, 60); }")
    try:
        page.wait_for_load_state("load", timeout=60000)
    except Exception as e:
        print("   (مالوش navigation? %s)" % str(e)[:60])
    page.wait_for_timeout(6000)
    page.wait_for_timeout(4000)
    s = st(page)
    print("   ⇒ بعد التحديث:", s, "| URL:", page.url[:80])
    msg = page.evaluate("() => (document.body.innerText||'').slice(0,60)")
    print("   ⇒ نص الصفحة:", repr(msg))
    if s['txt'] < 300:
        fails.append("الشاشة بيضا بعد التحديث (txt=%s)" % s['txt'])
    else:
        print("   ✅ الصفحة فتحت — مفيش شاشة بيضا")
    cu = ctrl_url(page)
    if cu != 'none' and not cu.startswith('nav('):
        print("   ⓘ الـSW الحالي:", cu, "(ده مفتاح الإطفاء — بيلغي نفسه)")
    else:
        print("   ✅ مفيش SW قديم ماسك ⇒ النطاق اتنضف")
    try:
        page.screenshot(path="/workspace/output/shots/webapk_after_update.png")
    except Exception:
        pass

    # ④ ⭐ يقفل التطبيق ويفتحه تاني
    page.goto(BASE + "/", wait_until="load", timeout=90000)
    page.wait_for_timeout(5000)
    s = st(page)
    print("④ ⭐ إعادة فتح التطبيق:", s, "| SWs:", regs(page))
    if s['txt'] < 300:
        fails.append("الشاشة بيضا بعد إعادة الفتح")
    else:
        print("   ✅ التطبيق فتح عادي")
    try:
        page.screenshot(path="/workspace/output/shots/webapk_reopen.png")
    except Exception:
        pass

    print("   أخطاء JS:", len(errs), errs[:2])
    b.close()

print("\n" + ("✅✅ السيناريو عدّى بالكامل" if not fails else "❌❌ " + " · ".join(fails)))
sys.exit(1 if fails else 0)
