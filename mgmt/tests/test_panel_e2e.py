#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🧪 اختبار شامل للوحة الإدارة (محلي — بدون إنتاج)

🎯 بيشغّل الـWorker الحقيقي فوق ملفات public/ ببيانات اختبارية، وبيتحقق:
   ١) البوابة: مافيش صفحة/ملف ثابت من غير جلسة.
   ٢) الملف الم静态 مافيشوش بيانات مدمجة (لا إيميلات ولا IP).
   ٣) الأقسام الثمانية بتتعرض فعلاً + الموبايل مافيش فيه تمرير أفقي.
   ④) نافذة التأكيد بتفتح قبل أي إجراء تعديلي.

⛔ مافيش أي اتصال بالإنترنت في الاختبار ده.
⛔ مافيش أي بيانات مستخدمين حقيقية (البيانات كلها synthetic).
"""
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MGMT = os.path.dirname(HERE)
PUBLIC = os.environ.get("MGMT_PUBLIC", os.path.join(MGMT, "public"))
EXE = "/root/.cache/ms-playwright/chromium-1243/chrome-linux/chrome"
PASSWORD = "e2e-password"
PORT = int(os.environ.get("MGMT_E2E_PORT", "8791"))
SHOT_DIR = os.environ.get("MGMT_SHOT_DIR", "/workspace/output/OCTA-ROUND18-EVIDENCE/evidence")
BASE = "http://127.0.0.1:%d" % PORT

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
IPV4_RE = re.compile(
    r"(?<![\w.])(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}"
    r"(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?![\w.])"
)

PASS = 0
FAIL = 0


def chk(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print("  ✅ %s%s" % (name, (" — " + extra) if extra else ""))
    else:
        FAIL += 1
        print("  ❌ %s%s" % (name, (" — " + extra) if extra else ""))


def hget(headers, name):
    """⛔ رؤوس Node بتبعت بحروف صغيرة ⇒ بحث case-insensitive."""
    low = {str(k).lower(): v for k, v in (headers or {}).items()}
    return low.get(name.lower())


def http(path, headers=None, method="GET", data=None):
    """⛔ مافيش تحويل (no redirect) عشان نقدر نقدر نتحقق من كود 302."""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    op = urllib.request.build_opener(NoRedirect)
    req = urllib.request.Request(BASE + path, method=method, data=data,
                                 headers=headers or {})
    try:
        r = op.open(req, timeout=30)
        body = r.read().decode("utf-8", "replace")
        return r.status, dict(r.headers), body
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        return e.code, dict(e.headers), body


def wait_port(port, timeout=30):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            s = socket.create_connection(("127.0.0.1", port), timeout=1)
            s.close()
            return True
        except OSError:
            time.sleep(0.2)
    return False


def main():
    env = dict(os.environ)
    env["MGMT_PUBLIC"] = PUBLIC
    srv = subprocess.Popen(
        ["node", os.path.join(HERE, "harness", "server.js"), str(PORT)],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, env=env)
    if not wait_port(PORT):
        print("❌ السيرفر المحلي ما اشتغلش")
        print(srv.stdout.read().decode("utf-8", "replace")[:2000])
        return 2
    try:
        run_checks()
    finally:
        srv.terminate()
        try:
            srv.wait(timeout=5)
        except Exception:
            srv.kill()
    print("\n═══ النتيجة: %d نجح · %d فشل ═══" % (PASS, FAIL))
    return 0 if FAIL == 0 else 1


def run_checks():
    from playwright.sync_api import sync_playwright

    print("\n📡 ١) البوابة على الملفات الثابتة (من غير جلسة)")
    st, hd, body = http("/index.html")
    chk("GET /index.html من غير جلسة ⇒ 401", st == 401, "status=%d" % st)
    chk("جسم الرد مافيشوش إيميل", len(EMAIL_RE.findall(body)) == 0,
        "عدد=%d" % len(EMAIL_RE.findall(body)))
    chk("جسم الرد مافيشوش IP", len(IPV4_RE.findall(body)) == 0,
        "عدد=%d" % len(IPV4_RE.findall(body)))

    st, hd, body = http("/", headers={"Accept": "text/html,application/xhtml+xml"})
    chk("GET / (متصفح) من غير جلسة ⇒ 302", st == 302, "status=%d" % st)
    chk("التحويل بيوصّل لصفحة الدخول",
        "/login.html" in (hget(hd, "location") or ""), hget(hd, "location") or "—")
    chk("جسم ردّ التحويل فاضي", len(body.strip()) == 0, "len=%d" % len(body.strip()))

    st, hd, body = http("/app.js")
    chk("GET /app.js من غير جلسة ⇒ 401", st == 401, "status=%d" % st)
    st, hd, body = http("/login.html")
    chk("GET /login.html مفتوح (public)", st == 200, "status=%d" % st)
    chk("صفحة الدخول نضيفة", len(EMAIL_RE.findall(body)) == 0 and len(IPV4_RE.findall(body)) == 0)

    print("\n🔑 ٢) الجلسة والـAPI")
    st, hd, body = http("/api/proxy?path=/api/admin/users")
    chk("GET /api/proxy من غير جلسة ⇒ 401", st == 401, "status=%d" % st)
    st, hd, body = http("/api/health")
    chk("GET /api/health ⇒ 200", st == 200, "status=%d" % st)
    hj = json.loads(body)
    chk("health فيه booleans بس",
        set(hj.keys()) == {"ok", "has_admin", "has_password"}, ",".join(sorted(hj.keys())))
    chk("health مافيشوش عنوان backend", "railway.app" not in body)

    st, hd, body = http("/api/login", method="POST", data=json.dumps({"password": "wrong"}).encode(),
                         headers={"Content-Type": "application/json"})
    chk("دخول بكلمة مرور غلط ⇒ 401", st == 401, "status=%d" % st)
    st, hd, body = http("/api/login", method="POST", data=json.dumps({"password": PASSWORD}).encode(),
                         headers={"Content-Type": "application/json"})
    chk("دخول بكلمة مرور صح ⇒ 200", st == 200, "status=%d" % st)
    set_cookie = hget(hd, "set-cookie") or ""
    cookie = set_cookie.split(";")[0]
    chk("الكوكي اتبع", bool(cookie), "httponly=%s" % ("HttpOnly" in set_cookie))

    print("\n📄 ٣) الملف الثابت بعد الجلسة — مافيش بيانات مدمجة")
    st, hd, body = http("/index.html", headers={"Cookie": cookie})
    chk("GET /index.html بجلسة ⇒ 200", st == 200, "status=%d" % st)
    chk("ملف HTML مافيشوش إيميلات", len(EMAIL_RE.findall(body)) == 0,
        "عدد=%d" % len(EMAIL_RE.findall(body)))
    chk("ملف HTML مافيشوش عناوين IP", len(IPV4_RE.findall(body)) == 0,
        "عدد=%d" % len(IPV4_RE.findall(body)))
    chk("ملف HTML مافيشوش عنوان backend", "railway.app" not in body)
    chk("في عنصر الـDATA فاضي", "R18-NO-EMBEDDED-DATA" in body)

    print("\n📱 ٤) اللوحة في المتصفح (390×844)")
    with sync_playwright() as pw:
        b = pw.chromium.launch(executable_path=EXE, args=["--no-sandbox", "--disable-dev-shm-usage"])
        ctx = b.new_context(viewport={"width": 390, "height": 844}, ignore_https_errors=True,
                            service_workers="allow", is_mobile=True, has_touch=True)
        p = ctx.new_page()
        errs = []
        p.on("pageerror", lambda e: errs.append(str(e)))

        p.goto(BASE + "/", wait_until="domcontentloaded", timeout=30000)
        p.wait_for_timeout(900)
        chk("زائر بيتبعت لصفحة الدخول", p.url.endswith("/login.html"), p.url)
        chk("شاشة الدخول ظاهرة", p.evaluate("!!document.querySelector('#pw')"))

        p.fill("#pw", PASSWORD)
        p.click("button[type=submit]")
        p.wait_for_timeout(2500)
        chk("بعد الدخول رجعنا للوحة", p.url.rstrip("/").endswith(str(PORT)) or "login" not in p.url, p.url)
        p.wait_for_timeout(2500)

        r = p.evaluate("""()=>{
          const ids=['secDaily','secUsers','secLogin','secPrices','secIncidents','secAudit','secDecisions','secAlerts'];
          const boxes={};
          ids.forEach(id=>{const e=document.getElementById(id); boxes[id]=e?(e.innerText.trim().length):-1;});
          return {
            boxes,
            boxesIds:['dailyBox','usersBox','loginBox','pricesBox','incidentsBox','auditBox','decisionsBox','alertsBox']
              .map(id=>{const e=document.getElementById(id); return e?(e.innerText.trim().length):-1;}),
            overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            nav: getComputedStyle(document.querySelector('#nav')).display,
            navButtons: document.querySelectorAll('#nav button').length,
            kpis: document.querySelectorAll('#kpis .kpi').length,
            usersRows: document.querySelectorAll('#usersBox tbody tr').length,
            alertsRows: document.querySelectorAll('#alertsBox tbody tr').length,
            errs: window.__errs||[]
          };
        }""")
        chk("الأقسام الثمانية موجودة", all(v > 0 for v in r["boxes"].values()),
            json.dumps(r["boxes"], ensure_ascii=False))
        chk("الجداول/البطاقات فيها محتوى", all(v > 0 for v in r["boxesIds"]),
            json.dumps(r["boxesIds"]))
        chk("مافيش تمرير أفقي على الموبايل", r["overflow"] == 0, "overflow=%d" % r["overflow"])
        chk("شريط التنقل ظاهر", r["nav"] == "block", r["nav"])
        chk("أزرار التنقل زادت (اللوحة)", r["navButtons"] >= 12, "أزرار=%d" % r["navButtons"])
        chk("مؤشرات الـKPI اتحمّلت", r["kpis"] >= 9, "kpis=%d" % r["kpis"])
        chk("صف المستخدمين فيها صفوف", r["usersRows"] >= 1, "صفوف=%d" % r["usersRows"])
        chk("صف التنبيهات فيه صفوف", r["alertsRows"] >= 1, "صفوف=%d" % r["alertsRows"])
        chk("مافيش أخطاء JavaScript", len(errs) == 0, "; ".join(errs[:2]))

        print("\n🛡️ ٥) نافذة التأكيد قبل أي إجراء تعديلي")
        p.evaluate("window.scrollTo(0,0)")
        p.evaluate("Panel.activatePlan('uidA1')")
        p.wait_for_timeout(500)
        chk("نافذة التأكيد اتفتحت", p.evaluate("document.querySelector('#pmodal').classList.contains('on')"))
        chk("في تحذير واضح", p.evaluate("(document.querySelector('#pmodalWarn')||{}).offsetHeight>0"))
        chk("في زر تأكيد", p.evaluate("(document.querySelector('#pmodalOk')||{}).offsetHeight>0"))
        p.click("#pmodalCancel")
        p.wait_for_timeout(300)
        chk("الإلغاء قفل النافذة", not p.evaluate("document.querySelector('#pmodal').classList.contains('on')"))

        print("\n🧭 ٦) فحص الصلاحيات + الخروج")
        p.evaluate("Panel.permCheck()")
        p.wait_for_timeout(1500)
        perm = p.evaluate("document.querySelector('#permBox').innerText")
        chk("فحص الصلاحيات عمل نتيجة", "سليم" in perm, perm[:80].replace("\n", " "))

        # 📸 لقطات (أدلة بصرية)
        try:
            os.makedirs(SHOT_DIR, exist_ok=True)
            p.evaluate("document.querySelector('#secDaily').scrollIntoView({block:'start',behavior:'instant'})")
            p.wait_for_timeout(1500)
            p.screenshot(path=SHOT_DIR + "/panel-mobile-390.png")
            p.evaluate("document.querySelector('#secAlerts').scrollIntoView({block:'start',behavior:'instant'})")
            p.wait_for_timeout(1500)
            p.screenshot(path=SHOT_DIR + "/panel-mobile-alerts.png")
        except Exception as e:
            print("  (لقطات: %s)" % str(e)[:60])

        p.evaluate("Panel.logout()")
        p.wait_for_timeout(1500)
        chk("الخروج رجّعنا لصفحة الدخول", p.url.endswith("/login.html"), p.url)
        snap = p.evaluate("localStorage.getItem('octa_mgmt_snapshot')")
        chk("اللقطة المحلية اتمسحت بعد الخروج", not snap)

        b.close()


if __name__ == "__main__":
    sys.exit(main())
