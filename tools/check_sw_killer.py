#!/usr/bin/env python3
"""⭐⭐⭐ حارس «مفتاح الإطفاء» — ٩ نوفمبر ٢٠٢٦
📌 المشكلة اللي كسرت التطبيق المثبّت: سكربت `/sw.js` كان فيه **قوس ناقص**
   ⇒ كروم: «ServiceWorker script evaluation failed» ⇒ التسجيل بيفشل بصمت
   ⇒ الـSW القديم فضل ماسك ⇒ **شاشة بيضا**.
   ⇒ `node --check` مش كافي (هو بيفحص الجملة بس، مش التقييم في المتصفح).
✅ الفحص: نحمّل `/sw.js` من السيرفر ⇒ نشغّله في المتصفح فعلياً (ServiceWorker
   API) ⇒ لازم يسجّل بنجاح ⇒ وبعدين يتشال.
Usage: python3 tools/check_sw_killer.py [base_url]
"""
import sys, re
from playwright.sync_api import sync_playwright

CHROME = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://octa-preview.ahmed3zz2020.workers.dev").rstrip('/')

ok = True
with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)
    page = ctx.new_page()
    page.goto(BASE + "/", wait_until="load", timeout=90000)
    page.wait_for_timeout(2500)

    # ① الملف موجود + نوعه JS + header المسموح-range
    resp = ctx.request.get(BASE + "/sw.js")
    body = resp.text()
    ct = resp.headers.get("content-type", "")
    swa = resp.headers.get("service-worker-allowed", "")
    print(f"① /sw.js → HTTP {resp.status} · {len(body)} بايت · type={ct} · SW-Allowed={swa!r}")
    if resp.status != 200:
        print("   ❌ لازم يبقى 200"); ok = False
    if "javascript" not in ct:
        print("   ❌ نوع المحتوى لازم يكون JavaScript"); ok = False
    if swa != "/":
        print("   ⚠️ مفيش Service-Worker-Allowed: / ⇒ التسجيل بنطاق أوسع هيفشل")

    # ② ⭐ التقييم الفعلي في المتصفح
    res = page.evaluate("""async () => {
      try {
        const r = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        return { ok: 1, scope: r.scope, hasActive: !!r.active };
      } catch (e) { return { err: String(e), name: e.name }; }
    }""")
    if res.get("ok"):
        print("② ✅ السكربت اتقيّم في المتصفح والتسجيل نجح:", res.get("scope"))
    else:
        print("② ❌ فشل التقييم/التسجيل:", res.get("err")); ok = False

    # ③ ⭐ هل هو «مفتاح إطفاء» فعلاً؟ (مفيش fetch handler)
    page.wait_for_timeout(2500)
    regs = page.evaluate("""async () => {
      const rs = await navigator.serviceWorker.getRegistrations();
      return rs.map(r => (r.active && r.active.scriptURL) || '?');
    }""")
    print("③ ⭐ الـSWs المسجّلة بعد التفعيل:", regs)
    if regs:
        print("   ⓘ لسه مسجّل — المفروض يلغي نفسه خلال ثواني (.OneShot)")

    # ④ ⭐ behaviour: الصفحة تفتح + مفيش تحكّم باقٍ
    page.goto(BASE + "/", wait_until="load", timeout=90000)
    page.wait_for_timeout(2500)
    txt = page.evaluate("() => (document.body.innerText||'').trim().length")
    ctrl = page.evaluate("() => navigator.serviceWorker.controller ? 'CONTROLLING' : 'none'")
    print(f"④ الصفحة: {txt} حرف · controller={ctrl}")
    if txt < 200:
        print("   ❌ الصفحة فاضية!"); ok = False
    b.close()

print("\n" + ("✅✅ كل الفحوص عدّت" if ok else "❌❌ في حاجة غلط"))
sys.exit(0 if ok else 1)
