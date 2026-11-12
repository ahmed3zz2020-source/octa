#!/usr/bin/env python3
"""
اختبار مسار V2 الأول — على موبايل ٣٦٠ بكسل وعلى كمبيوتر.
يفحص: المسار كاملًا + حالات التحميل/النقص/الخطأ + عزل الشبكة.
يكتب: صورًا + تقرير JSON.
"""
import json
import os
import socket
import subprocess
import sys
import time

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # .../v2
SHOTS = os.environ.get("V2_SHOTS", "/workspace/output/v2-batch1/screenshots")
REPORT = os.environ.get("V2_REPORT", "/workspace/output/v2-batch1/test-report.json")
PORT = int(os.environ.get("V2_PORT", "8099"))
BASE = f"http://127.0.0.1:{PORT}"

FORBIDDEN_HOSTS = ("railway.app", "railway.dev", "telegram", "t.me",
                    "octashares.com", "api.", "localhost", "0.0.0.0")

results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("  ✅ " if ok else "  ⛔ ") + name + ((" — " + detail) if detail else ""))
    return ok


def free_port(p):
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", p))
        return True
    except OSError:
        return False
    finally:
        s.close()


def run_suite(browser, label, width, height):
    print(f"\n=== {label} ({width}×{height}) ===")
    ctx = browser.new_context(viewport={"width": width, "height": height},
                              device_scale_factor=2, locale="ar-EG")
    page = ctx.new_page()
    requests = []
    console_errors = []
    page.on("request", lambda r: requests.append(r.url))
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append("pageerror: " + str(e)))

    # ① شاشة السوق + أربعة مؤشرات
    page.goto(BASE + "/index.html", wait_until="load")
    page.wait_for_selector('[data-testid="kpi-card"]', timeout=8000)
    kpis = page.locator('[data-testid="kpi-card"]').count()
    check(f"[{label}] شاشة السوق تعرض ٤ مؤشرات", kpis == 4, f"العدد={kpis}")
    check(f"[{label}] لافتة «بيانات تجريبية» ظاهرة",
          page.locator('[data-testid="mock-banner"]').first.is_visible())
    check(f"[{label}] شارة «تجريبي» ظاهرة", page.locator('[data-testid="mock-pill"]').is_visible())
    page.screenshot(path=f"{SHOTS}/{label}-01-market.png", full_page=True)

    # ② حالة التحميل (skeleton) — وضع ?slow=1 يجعلها حتمية
    page.goto(BASE + "/index.html?slow=1#/stock/MOCK1", wait_until="load")
    loading_ok = page.locator('[data-testid="skeleton"]').first.is_visible(timeout=3000)
    check(f"[{label}] حالة التحميل تظهر قبل البيانات", loading_ok)

    # ③ صفحة السهم: سعر + شارت + مصدر + توقيت
    page.wait_for_selector('[data-testid="stock-price"]', timeout=8000)
    price = page.locator('[data-testid="stock-price"]').inner_text()
    check(f"[{label}] صفحة السهم تعرض السعر", "ج.م" in price, price)
    check(f"[{label}] الشارت مرسوم (SVG)",
          page.locator('[data-testid="chart-card"] svg.v2-chart').count() == 1)
    src = page.locator('[data-testid="stock-source"]').inner_text()
    check(f"[{label}] مصدر البيانات معروض", "تجريبية" in src, src)
    asof = page.locator('[data-testid="stock-asof"]').inner_text()
    check(f"[{label}] توقيت البيانات معروض", "نوفمبر" in asof, asof)
    page.screenshot(path=f"{SHOTS}/{label}-02-stock.png", full_page=True)

    # ④ حالة الخطأ (MOCK5)
    page.goto(BASE + "/index.html#/stock/MOCK5", wait_until="load")
    page.wait_for_selector('[data-testid="error-card"]', timeout=8000)
    check(f"[{label}] حالة الخطأ تظهر مع زر إعادة المحاولة",
          page.locator('[data-testid="retry-btn"]').is_visible())
    page.screenshot(path=f"{SHOTS}/{label}-03-error.png", full_page=True)

    # ⑤ حالة البيانات الناقصة (MOCK6)
    page.goto(BASE + "/index.html#/stock/MOCK6", wait_until="load")
    page.wait_for_selector('[data-testid="missing-value"]', timeout=8000)
    missing = page.locator('[data-testid="missing-value"]').count()
    check(f"[{label}] البيانات الناقصة تُعرض كـ«غير متاح»", missing >= 1, f"عدد={missing}")
    page.screenshot(path=f"{SHOTS}/{label}-04-missing.png", full_page=True)

    # ⑥ المقارنة حتى ٣ أسهم + منع الرابع
    page.goto(BASE + "/index.html#/market", wait_until="load")
    page.wait_for_selector('[data-testid="add-compare"]', timeout=8000)
    for sym in ("MOCK1", "MOCK2", "MOCK3"):
        page.locator(f'[data-testid="add-compare"][data-symbol="{sym}"]').click()
        page.wait_for_selector(f'[data-testid="add-compare"][data-symbol="{sym}"]', timeout=8000)
    count = page.locator('[data-testid="compare-count"]').inner_text()
    check(f"[{label}] عدّاد المقارنة = ٣/٣", "٣" in count, count)
    page.locator('[data-testid="add-compare"][data-symbol="MOCK4"]').click()
    page.wait_for_timeout(400)
    alert_shown = page.locator('[data-testid="limit-alert"]').is_visible()
    check(f"[{label}] منع إضافة رابع سهم (تنبيه الحد)", alert_shown)
    page.screenshot(path=f"{SHOTS}/{label}-05-compare-limit.png", full_page=True)

    # ⑦ صفحة المقارنة: ٣ بطاقات + شارت لكل سهم
    page.goto(BASE + "/index.html#/compare", wait_until="load")
    page.wait_for_selector('[data-testid="compare-slot"]', timeout=8000)
    slots = page.locator('[data-testid="compare-slot"]').count()
    check(f"[{label}] صفحة المقارنة تعرض ٣ أسهم", slots == 3, f"العدد={slots}")
    check(f"[{label}] لكل سهم شارت في المقارنة",
          page.locator('[data-testid="compare-chart"] svg.v2-chart').count() == 3)
    page.screenshot(path=f"{SHOTS}/{label}-06-compare.png", full_page=True)

    # ⑧ العزل: لا طلبات خارجية + لا محاولة fetch + لا تخزين
    ext = [u for u in requests if not u.startswith(BASE)]
    check(f"[{label}] كل الطلبات من نفس الأصل (لا Railway/تلجرام/إنتاج)",
          len(ext) == 0, f"خارجي={ext[:4]}")
    hits = [u for u in requests if any(h in u for h in FORBIDDEN_HOSTS)]
    check(f"[{label}] لا طلبات لأسماء محظورة", len(hits) == 0, f"{hits[:4]}")
    attempts = page.evaluate("window.__V2_NETWORK_ATTEMPTS__ ? window.__V2_NETWORK_ATTEMPTS__.length : -1")
    check(f"[{label}] حارس الشبكة سجّل صفر محاولة", attempts == 0, f"المحاولات={attempts}")
    storage = page.evaluate("JSON.stringify({l:Object.keys(localStorage),s:Object.keys(sessionStorage),c:document.cookie})")
    check(f"[{label}] لا تخزين محلي ولا كوكيز", storage == '{"l":[],"s":[],"c":""}', storage)
    check(f"[{label}] لا أخطاء JavaScript في الكونسول", len(console_errors) == 0, f"{console_errors[:3]}")

    ctx.close()
    return {"label": label, "requests": requests, "console_errors": console_errors}


def chromium_path():
    """مسار Chromium المتاح في البيئة (بدون headless-shell ⇒ نمرّره صراحة)"""
    roots = ["/root/.cache/ms-playwright", os.path.expanduser("~/.cache/ms-playwright"),
             os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "")]
    for root in roots:
        if not root or not os.path.isdir(root):
            continue
        for dirpath, _dirs, files in os.walk(root):
            if dirpath.endswith("chrome-linux") and "chrome" in files:
                return os.path.join(dirpath, "chrome")
    return None


def start_server(root, port):
    """يشغّل سيرفر ثابت ويجرب منافذ متتالية حتى يجد واحدًا متاحًا"""
    for candidate in range(port, port + 20):
        srv = subprocess.Popen([sys.executable, "-m", "http.server", str(candidate), "--bind", "127.0.0.1"],
                                cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(20):
            time.sleep(0.15)
            with socket.socket() as s:
                s.settimeout(0.4)
                if s.connect_ex(("127.0.0.1", candidate)) == 0:
                    return srv, candidate
        srv.terminate()
    raise RuntimeError("مفيش منفذ متاح للاختبار")


def main():
    global BASE
    os.makedirs(SHOTS, exist_ok=True)
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    srv, port = start_server(ROOT, PORT)
    BASE = f"http://127.0.0.1:{port}"
    print(f"🌐 سيرفر الاختبار: {BASE}")
    try:
        with sync_playwright() as p:
            exe = chromium_path()
            browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
            suites = [run_suite(browser, "mobile-360", 360, 740),
                      run_suite(browser, "desktop-1440", 1440, 900)]
            browser.close()
    finally:
        srv.terminate()

    passed = sum(1 for r in results if r["ok"])
    total = len(results)
    payload = {
        "ran_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "base_url": BASE,
        "total": total, "passed": passed, "failed": total - passed,
        "checks": results,
        "suites": [{"label": s["label"], "request_count": len(s["requests"]),
                    "external_requests": [u for u in s["requests"] if not u.startswith(BASE)],
                    "console_errors": s["console_errors"]} for s in suites],
    }
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    print(f"\n{'='*50}\nالنتيجة: {passed}/{total} ناجح · التقرير: {REPORT}")
    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
