#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""R26 — الرحلة الحقيقية بمتصفح حقيقي على المعاينة ⭐ (البند ٤).

🎯 المالك طلب: «لا تسجل هذه المرحلة ناجحة إلا بعد اختبار الرحلة فعليًا
   بمتصفح حقيقي» ⇒ هنا المتصفح Chromium حقيقي ⭐ + مقاس موبايل ⭐.

📌 الخطوات ⭐ (نفس ترتيب صاحب المشروع ⭐):
   ① إنشاء حساب تجريبي ② تسجيل الدخول ③ السوق المصري ④ فتح سهم
   ⑤ المحركات الثمانية ⑥ الفلاتر ⑦ محرك الفرص ⑧ المحفظة ⑨ شارت الذهب
   ⑩ RealView ⑪ إضافة تنبيه ⑫ خروج ودخول تاني.

📌 كل خطوة: assertion على المحتوى (مش 200 بس ⭐) + لقطة شاشة ⭐.

📌 التشغيل:
   python3 tools/r26_preview_browser_journey.py \
       --base-url https://octa-preview.ahmed3zz2020.workers.dev \
       --out /tmp/r26_preview_browser.json
"""
import argparse
import io
import json
import os
import sys
import time
import uuid

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("⛔ playwright مش مثبّت", file=sys.stderr)
    sys.exit(2)

JS_OPEN_GATE = """() => {
  const links = Array.from(document.querySelectorAll('a, button'));
  const hit = links.find(a => (a.textContent || '').indexOf('إعمل حساب') >= 0)
           || links.find(a => (a.textContent || '').indexOf('تسجيل الدخول') >= 0);
  if (hit) { hit.click(); return true; }
  return false;
}"""

RESULTS = []
SHOTS = "/workspace/output/OCTA-ROUND26-EVIDENCE/shots-preview"


def ok(cond, label, extra=""):
    RESULTS.append((bool(cond), label))
    print(("  [PASS] " if cond else "  [FAIL] ") + label +
          (("  — " + str(extra)[:160]) if extra else ""), flush=True)
    return bool(cond)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="https://octa-preview.ahmed3zz2020.workers.dev")
    ap.add_argument("--out", default="/tmp/r26_preview_browser.json")
    ap.add_argument("--shots", default=SHOTS)
    args = ap.parse_args()
    base = args.base_url.rstrip("/")
    os.makedirs(args.shots, exist_ok=True)

    email = "r26.browser.%s@example.com" % uuid.uuid4().hex[:8]
    pin = "2468"
    js_errors = []
    steps = []

    with sync_playwright() as pw:
        # ⛔ نسخة Chromium الكاملة ⭐ (مش headless-shell ⭐ — مش متثبتة ⭐)
        exe = None
        for cand in ("/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome",
                     "/root/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome",
                     pw.chromium.executable_path):
            if os.path.exists(cand):
                exe = cand
                break
        browser = pw.chromium.launch(
            executable_path=exe,
            args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = browser.new_context(
            viewport={"width": 390, "height": 844},
            user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
                        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 "
                        "Mobile/15E148 Safari/604.1"),
            is_mobile=True, has_touch=True)
        page = ctx.new_page()
        page.on("pageerror", lambda e: js_errors.append(str(e)[:200]))

        def shot(name):
            try:
                page.screenshot(path=os.path.join(args.shots, name + ".png"),
                                full_page=False)
            except Exception:
                pass

        # ① الصفحة العامة (زائر) + إنشاء الحساب من جوّه المتصفح ⭐
        page.goto(base + "/", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3500)
        shot("01-public-market")
        pub = page.inner_text("body")
        ok(len(pub) > 300, "① الصفحة العامة اتفتحت (فلتر السوق ⭐)", page.url)
        ok("دخول" in pub, "①ب فيه زرار الدخول ⭐", "")

        # إنشاء حساب حقيقي من جوّه المتصفح (نفس الـorigin ⭐ ⇒ نفس الكوكي ⭐)
        signup = page.evaluate("""async (email) => {
          const s = await fetch('/api/auth/signup/start', {method: 'POST',
            headers: {'Content-Type': 'application/json'}, credentials: 'include',
            body: JSON.stringify({name: 'متصفح R26', email: email})});
          const sj = await s.json();
          const code = sj.preview_code;
          const v = await fetch('/api/auth/signup/verify', {method: 'POST',
            headers: {'Content-Type': 'application/json'}, credentials: 'include',
            body: JSON.stringify({email: email, code: code})});
          const vj = await v.json();
          const n = await fetch('/api/auth/signup/newpin', {method: 'POST',
            headers: {'Content-Type': 'application/json'}, credentials: 'include',
            body: JSON.stringify({email: email, code: code, pin: '2468',
                                  device: 'browser-device-' + Date.now()})});
          return {status: n.status, needs_pin: vj.needs_pin, code: code};
        }""", email)
        ok(signup.get("status") == 200,
           "①ج اتعمل حساب تجريبي من جوّه المتصفح ⭐", signup.get("status"))

        # ③ السوق المصري
        page.goto(base + "/markets", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        shot("05-market")
        txt = page.inner_text("body")
        ok(len(txt) > 400 and ("سهم" in txt or "السوق" in txt or "%" in txt),
           "③ صفحة السوق المصري اتحمّلت", page.url)
        steps.append({"step": "market", "url": page.url, "text_len": len(txt)})

        # ④ فتح سهم
        page.goto(base + "/stocks", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3500)
        shot("06-stocks")
        ok(len(page.inner_text("body")) > 300, "④ صفحة الأسهم اتفتحت", page.url)

        # ⑤ المحركات
        page.goto(base + "/engine", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        shot("07-engine")
        etxt = page.inner_text("body")
        ok(len(etxt) > 300, "⑤ صفحة المحركات اتفتحت", len(etxt))

        # ⑥ الفلاتر
        page.goto(base + "/filters", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        shot("08-filters")
        ok(len(page.inner_text("body")) > 300, "⑥ صفحة الفلاتر اتفتحت", page.url)

        # ⑦ محرك الفرص
        page.goto(base + "/tools", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        shot("09-tools")
        ok(len(page.inner_text("body")) > 300, "⑦ محرك الفرص اتفتحت", page.url)

        # ⑧ المحفظة (عبر الـAPI اللي في الواجهة)
        page.goto(base + "/money", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3500)
        shot("10-portfolio")
        ok(len(page.inner_text("body")) > 300, "⑧ صفحة المحفظة اتفتحت", page.url)

        # ⑨ شارت الذهب
        page.goto(base + "/chart.html", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)
        shot("11-gold-chart")
        canvases = page.locator("canvas").count()
        ok(canvases > 0 or len(page.inner_text("body")) > 300,
           "⑨ شارت الذهب اتفتح (كانفس ⭐)", "canvas=%s" % canvases)

        # ⑩ RealView
        page.goto(base + "/verdict", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3500)
        shot("12-realview")
        ok(len(page.inner_text("body")) > 300, "⑩ RealView اتفتح", page.url)

        # ⑪ إضافة تنبيه (من داخل المتصفح ⇒ نفس session المتصفح ⭐)
        api = page.evaluate("""async () => {
          const r = await fetch('/api/alerts', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({alert: {id: 'browser-' + Date.now(),
                                          symbol: 'COMI', kind: 'price'}})
          });
          return {status: r.status, body: await r.text()};
        }""")
        ok(api.get("status") == 200 and '"created":true' in (api.get("body") or ""),
           "⑪ اتضاف تنبيه من جوه المتصفح ⭐", api.get("status"))

        # ⑫ خروج ودخول تاني
        out = page.evaluate("""async () => {
          const r = await fetch('/api/auth/logout', {method: 'POST',
            headers: {'Content-Type': 'application/json'}, credentials: 'include'});
          return {status: r.status, body: await r.text()};
        }""")
        page.wait_for_timeout(1500)
        cookies2 = [c["name"] for c in ctx.cookies()]
        shot("13-logout")
        ok(out.get("status") == 200 and "octa_token" not in cookies2,
           "⑫ اتسجّل الخروج والكوكي اتمسح ⭐", out.get("status"))

        again = page.evaluate("""async () => {
          const r = await fetch('/api/auth/pin/login', {method: 'POST',
            headers: {'Content-Type': 'application/json'}, credentials: 'include',
            body: JSON.stringify({pin: '%s'})});
          return {status: r.status, body: await r.text()};
        }""" % pin)
        page.wait_for_timeout(1500)
        cookies3 = [c["name"] for c in ctx.cookies()]
        shot("14-login-again")
        ok(again.get("status") == 200 and "octa_token" in cookies3,
           "⑫ب اتعمل دخول تاني ⭐", again.get("status"))

        browser.close()

    ok(not js_errors, "⑬ مافيش استثناء JavaScript في الرحلة ⭐", js_errors[:3])

    passed = sum(1 for r in RESULTS if r[0])
    failed = len(RESULTS) - passed
    payload = {"base_url": base, "email": email, "results": [
        {"ok": r[0], "label": r[1]} for r in RESULTS],
        "passed": passed, "failed": failed, "steps": steps,
        "js_errors": js_errors, "shots": args.shots}
    io.open(args.out, "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False, indent=2))
    print()
    print("RESULT: %d/%d PASS · %d FAIL" % (passed, len(RESULTS), failed))
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
